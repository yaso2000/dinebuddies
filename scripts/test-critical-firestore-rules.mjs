import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
    deleteDoc,
    doc,
    serverTimestamp,
    setDoc,
    updateDoc,
} from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-dinebuddies-critical';

const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
        host: '127.0.0.1',
        port: 8080,
        rules: readFileSync('firestore.rules', 'utf8'),
    },
});

async function resetFirestore() {
    await testEnv.clearFirestore();
}

try {
    await resetFirestore();

    const aliceDb = testEnv.authenticatedContext('alice', {
        email: 'alice@example.com',
        email_verified: true,
    }).firestore();
    const aliceRef = doc(aliceDb, 'users/alice');

    await assertFails(setDoc(aliceRef, {
        uid: 'alice',
        role: 'admin',
        display_name: 'Alice',
    }));

    await assertFails(setDoc(aliceRef, {
        uid: 'alice',
        role: 'user',
        display_name: 'Alice',
        paidCredits: 999999,
    }));

    await assertSucceeds(setDoc(aliceRef, {
        uid: 'alice',
        role: 'user',
        display_name: 'Alice',
        email: 'alice@example.com',
    }));

    await assertFails(updateDoc(aliceRef, {
        paidCredits: 999999,
        subscriptionTier: 'premium',
    }));

    await assertSucceeds(updateDoc(aliceRef, {
        display_name: 'Alice Updated',
    }));

    const adminByRoleDb = testEnv.authenticatedContext('role-admin', {
        email: 'role-admin@example.com',
        email_verified: true,
    }).firestore();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users/role-admin'), {
            uid: 'role-admin',
            role: 'admin',
        });
    });
    await assertFails(deleteDoc(doc(adminByRoleDb, 'users/alice')));

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'private_invitations/draft-1'), {
            authorId: 'alice',
            author: { id: 'alice', name: 'Alice' },
            invitedFriends: ['bob'],
            rsvps: { bob: 'pending' },
            status: 'draft',
            title: 'Draft Dinner',
            createdAt: serverTimestamp(),
        });
    });

    const draftRef = doc(aliceDb, 'private_invitations/draft-1');
    await assertFails(updateDoc(draftRef, {
        status: 'published',
        publishedAt: serverTimestamp(),
    }));

    await assertSucceeds(updateDoc(draftRef, {
        title: 'Updated Draft Dinner',
    }));

    const bobDb = testEnv.authenticatedContext('bob', {
        email: 'bob@example.com',
        email_verified: true,
    }).firestore();
    await assertSucceeds(updateDoc(doc(bobDb, 'private_invitations/draft-1'), {
        rsvps: { bob: 'accepted' },
    }));

    console.log('Critical Firestore security rules assertions passed.');
} catch (error) {
    console.error(error);
    process.exitCode = 1;
} finally {
    await testEnv.cleanup();
}
