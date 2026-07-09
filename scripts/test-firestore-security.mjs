import fs from 'node:fs';
import assert from 'node:assert/strict';
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

const testEnv = await initializeTestEnvironment({
    projectId: 'dinebuddies-security-test',
    firestore: {
        rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
});

try {
    await testEnv.clearFirestore();

    const authed = testEnv.authenticatedContext('user_a', { email: 'user@example.test' }).firestore();
    const other = testEnv.authenticatedContext('user_b', { email: 'other@example.test' }).firestore();
    const adminDb = testEnv.authenticatedContext('admin_user', { admin: true }).firestore();

    await assertSucceeds(setDoc(doc(authed, 'users/user_a'), {
        uid: 'user_a',
        role: 'user',
        display_name: 'User A',
        email: 'user@example.test',
        isGuest: false,
    }));

    await assertFails(setDoc(doc(other, 'users/user_b'), {
        uid: 'user_b',
        role: 'admin',
        display_name: 'Mallory',
    }));

    await assertFails(setDoc(doc(testEnv.authenticatedContext('user_c').firestore(), 'users/user_c'), {
        uid: 'user_c',
        role: 'user',
        paidCredits: 100000,
    }));

    await assertSucceeds(updateDoc(doc(authed, 'users/user_a'), {
        display_name: 'User A Safe Edit',
    }));
    await assertFails(updateDoc(doc(authed, 'users/user_a'), {
        paidCredits: 100000,
    }));
    await assertFails(updateDoc(doc(authed, 'users/user_a'), {
        role: 'admin',
    }));
    await assertFails(updateDoc(doc(authed, 'users/user_a'), {
        'businessInfo.customLimits.offerSlots': 999,
    }));

    await assertSucceeds(setDoc(doc(authed, 'private_invitations/draft_a'), {
        authorId: 'user_a',
        author: { id: 'user_a' },
        invitedFriends: ['user_b'],
        status: 'draft',
        title: 'Draft dinner',
    }));
    await assertFails(setDoc(doc(authed, 'private_invitations/published_a'), {
        authorId: 'user_a',
        author: { id: 'user_a' },
        invitedFriends: ['user_b'],
        status: 'published',
        title: 'Direct publish attempt',
    }));
    await assertFails(updateDoc(doc(authed, 'private_invitations/draft_a'), {
        status: 'published',
    }));
    await assertSucceeds(updateDoc(doc(authed, 'private_invitations/draft_a'), {
        title: 'Edited draft dinner',
    }));

    await assertSucceeds(setDoc(doc(adminDb, 'app_settings/security_test'), { ok: true }));
    assert.equal(true, true);
    console.log('firestore security assertions passed');
} finally {
    await testEnv.cleanup();
}
