import fs from 'node:fs';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
} from 'firebase/firestore';
import {
    ref,
    uploadString,
} from 'firebase/storage';

const projectId = `dinebuddies-rules-${Date.now()}`;

const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
        rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
    storage: {
        rules: fs.readFileSync('storage.rules', 'utf8'),
    },
});

async function seed(callback) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
        await callback(context.firestore(), context.storage());
    });
}

try {
    const alice = testEnv.authenticatedContext('alice', {
        email: 'alice@example.com',
        email_verified: true,
    }).firestore();
    const aliceStorage = testEnv.authenticatedContext('alice').storage();
    const mallory = testEnv.authenticatedContext('mallory', {
        email: 'mallory@example.com',
        email_verified: false,
    }).firestore();
    const adminDb = testEnv.authenticatedContext('admin', {
        admin: true,
        email: 'admin@example.com',
        email_verified: true,
    }).firestore();
    const anonStorage = testEnv.unauthenticatedContext().storage();

    await assertFails(setDoc(doc(alice, 'users/alice'), {
        uid: 'alice',
        role: 'admin',
        email: 'alice@example.com',
    }));

    await assertFails(setDoc(doc(alice, 'users/alice'), {
        uid: 'alice',
        role: 'user',
        email: 'alice@example.com',
        paidCredits: 100000,
    }));

    await assertSucceeds(setDoc(doc(alice, 'users/alice'), {
        uid: 'alice',
        role: 'user',
        display_name: 'Alice',
        email: 'alice@example.com',
        emailVerified: true,
        authEmail: 'alice@example.com',
        isGuest: false,
    }));

    await assertFails(updateDoc(doc(alice, 'users/alice'), {
        subscriptionTier: 'elite',
        purchasedPrivateCredits: 99,
    }));

    await assertSucceeds(updateDoc(doc(alice, 'users/alice'), {
        display_name: 'Alice Updated',
    }));

    const badBizDb = testEnv.authenticatedContext('badbiz', {
        email: 'badbiz@example.com',
        email_verified: true,
    }).firestore();
    await assertFails(setDoc(doc(badBizDb, 'users/badbiz'), {
        uid: 'badbiz',
        role: 'partner',
        accountType: 'business',
        email: 'badbiz@example.com',
        businessInfo: {
            businessName: 'Alice Cafe',
            customLimits: { offerCredits: 999 },
        },
    }));

    const bizDb = testEnv.authenticatedContext('biz', {
        email: 'biz@example.com',
        email_verified: true,
    }).firestore();
    await assertSucceeds(setDoc(doc(bizDb, 'users/biz'), {
        uid: 'biz',
        role: 'partner',
        accountType: 'business',
        email: 'biz@example.com',
        businessInfo: {
            businessName: 'Biz Cafe',
            city: 'Bundaberg',
        },
    }));

    await seed(async (db) => {
        await setDoc(doc(db, 'users/mallory'), {
            uid: 'mallory',
            role: 'admin',
            email: 'mallory@example.com',
        });
    });
    await assertFails(setDoc(doc(mallory, 'app_settings/pricing'), { writable: true }));
    await assertSucceeds(setDoc(doc(adminDb, 'app_settings/pricing'), { writable: true }));

    await assertFails(setDoc(doc(alice, 'private_invitations/published-create'), {
        authorId: 'alice',
        author: { id: 'alice' },
        invitedFriends: ['bob'],
        privacy: 'private',
        status: 'published',
    }));

    await assertSucceeds(setDoc(doc(alice, 'private_invitations/draft'), {
        authorId: 'alice',
        author: { id: 'alice' },
        invitedFriends: ['bob'],
        privacy: 'private',
        status: 'draft',
        rsvps: { bob: 'pending' },
    }));

    await assertFails(updateDoc(doc(alice, 'private_invitations/draft'), {
        status: 'published',
    }));
    await assertFails(updateDoc(doc(alice, 'private_invitations/draft'), {
        publishedAt: new Date().toISOString(),
    }));

    await assertFails(uploadString(
        ref(anonStorage, 'feedback_media/biz/proof.txt'),
        'not allowed',
        'raw',
        { contentType: 'image/png' },
    ));
    await assertSucceeds(uploadString(
        ref(aliceStorage, 'feedback_media/biz/proof.png'),
        'iVBORw0KGgo=',
        'base64',
        { contentType: 'image/png' },
    ));

    await assertSucceeds(getDoc(doc(alice, 'users/alice')));
    console.log('Security rules exploit assertions passed.');
} finally {
    await testEnv.cleanup();
}
