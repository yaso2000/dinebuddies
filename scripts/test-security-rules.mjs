import assert from 'node:assert/strict';
import fs from 'node:fs';

import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';

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

async function seedFirestore() {
    await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users', 'user1'), {
            role: 'user',
            displayName: 'User One',
            freeCredits: 0,
            paidCredits: 0,
            subscriptionTier: 'free',
            joinedCommunities: [],
        });
        await setDoc(doc(db, 'users', 'business1'), {
            role: 'business',
            displayName: 'Business One',
            communityMembers: [],
        });
    });
}

try {
    await seedFirestore();

    const userDb = testEnv.authenticatedContext('user1', {
        email: 'user1@example.com',
        email_verified: true,
    }).firestore();

    await assertSucceeds(updateDoc(doc(userDb, 'users', 'user1'), {
        displayName: 'Safe Profile Edit',
    }));

    await assertFails(updateDoc(doc(userDb, 'users', 'user1'), {
        paidCredits: 999999,
    }));

    await assertFails(updateDoc(doc(userDb, 'users', 'user1'), {
        subscriptionTier: 'elite',
    }));

    await assertFails(updateDoc(doc(userDb, 'users', 'user1'), {
        joinedCommunities: ['business1'],
    }));

    await assertFails(setDoc(doc(userDb, 'users', 'new-admin'), {
        role: 'admin',
        displayName: 'Escalated Admin',
    }));

    await assertSucceeds(deleteDoc(doc(userDb, 'users', 'user1')));
    await assertFails(setDoc(doc(userDb, 'users', 'user1'), {
        role: 'admin',
        displayName: 'Recreated Admin',
    }));

    await assertFails(addDoc(collection(userDb, 'partner_notifications'), {
        restaurantId: 'business1',
        senderId: 'user1',
        type: 'business_feedback',
        title: 'Spoofed alert',
        message: 'This should not be client-spoofable',
    }));

    await assertSucceeds(addDoc(collection(userDb, 'partner_notifications'), {
        restaurantId: 'user1',
        senderId: 'user1',
        type: 'self_test',
        title: 'Self notification',
        message: 'Allowed self-only notification',
    }));

    const unauthStorage = testEnv.unauthenticatedContext().storage();
    await assertFails(uploadBytes(
        ref(unauthStorage, 'feedback_media/business1/proof.jpg'),
        new Uint8Array([1, 2, 3]),
        { contentType: 'image/jpeg' },
    ));

    const userStorage = testEnv.authenticatedContext('user1').storage();
    await assertSucceeds(uploadBytes(
        ref(userStorage, 'feedback_media/business1/proof.jpg'),
        new Uint8Array([1, 2, 3]),
        { contentType: 'image/jpeg' },
    ));

    console.log('Security rules assertions passed');
} finally {
    await testEnv.cleanup();
}

assert.ok(true);
