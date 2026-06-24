import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
    initializeTestEnvironment,
    assertFails,
    assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp,
} from 'firebase/firestore';

const projectId = `dinebuddies-critical-${Date.now()}`;
const rules = fs.readFileSync('firestore.rules', 'utf8');

const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
});

async function seed(path, data) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), path), data);
    });
}

try {
    const alice = testEnv.authenticatedContext('alice', {
        email: 'alice@example.com',
        email_verified: true,
    }).firestore();

    await assertSucceeds(setDoc(doc(alice, 'users/alice'), {
        uid: 'alice',
        role: 'user',
        display_name: 'Alice',
        email: 'alice@example.com',
        created_time: serverTimestamp(),
    }));

    await assertFails(setDoc(doc(alice, 'users/escalate-admin'), {
        uid: 'escalate-admin',
        role: 'admin',
        display_name: 'Mallory',
    }));

    await assertFails(setDoc(doc(alice, 'users/escalate-credits'), {
        uid: 'escalate-credits',
        role: 'user',
        display_name: 'Mallory',
        subscriptionTier: 'elite',
        paidCredits: 9999,
    }));

    await assertFails(updateDoc(doc(alice, 'users/alice'), {
        subscriptionTier: 'elite',
        purchasedPrivateCredits: 100,
    }));

    await assertSucceeds(updateDoc(doc(alice, 'users/alice'), {
        display_name: 'Alice Updated',
    }));

    await seed('users/doc-admin', {
        uid: 'doc-admin',
        role: 'admin',
        display_name: 'Doc Admin',
    });
    const docAdmin = testEnv.authenticatedContext('doc-admin').firestore();
    await assertFails(setDoc(doc(docAdmin, 'app_settings/maintenance'), { enabled: true }));

    const claimAdmin = testEnv.authenticatedContext('claim-admin', { admin: true }).firestore();
    await assertSucceeds(setDoc(doc(claimAdmin, 'app_settings/maintenance'), { enabled: true }));

    await assertFails(setDoc(doc(alice, 'private_invitations/published-create'), {
        authorId: 'alice',
        invitedFriends: ['friend'],
        status: 'published',
        publishedAt: serverTimestamp(),
    }));

    await assertSucceeds(setDoc(doc(alice, 'private_invitations/draft-create'), {
        authorId: 'alice',
        invitedFriends: ['friend'],
        status: 'draft',
        title: 'Dinner',
    }));

    await assertFails(updateDoc(doc(alice, 'private_invitations/draft-create'), {
        status: 'published',
        publishedAt: serverTimestamp(),
    }));

    await seed('users/free-business', {
        uid: 'free-business',
        role: 'business',
        subscriptionTier: 'free',
    });
    const freeBusiness = testEnv.authenticatedContext('free-business').firestore();
    await assertFails(setDoc(doc(freeBusiness, 'offers/free-offer'), {
        partnerId: 'free-business',
        title: 'Unpaid premium offer',
    }));

    await seed('users/elite-business', {
        uid: 'elite-business',
        role: 'business',
        subscriptionTier: 'elite',
    });
    const eliteBusiness = testEnv.authenticatedContext('elite-business').firestore();
    await assertSucceeds(setDoc(doc(eliteBusiness, 'offers/elite-offer'), {
        partnerId: 'elite-business',
        title: 'Paid premium offer',
    }));

    const aliceSnap = await getDoc(doc(alice, 'users/alice'));
    assert.equal(aliceSnap.data().subscriptionTier, undefined);

    console.log('critical Firestore rules checks passed');
} finally {
    await testEnv.cleanup();
}
