/**
 * Rules regression: community chat membership must not be self-grantable.
 * Requires Firestore emulator (via @firebase/rules-unit-testing).
 */
import { readFileSync } from 'node:fs';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    addDoc,
} from 'firebase/firestore';

const projectId = 'demo-dinebuddies-community-membership';
const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
        rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
});

try {
    await testEnv.clearFirestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users/partner1'), {
            role: 'business',
            communityMembers: ['alice'],
            businessInfo: { businessName: 'Cafe' },
        });
        await setDoc(doc(db, 'users/alice'), {
            role: 'user',
            joinedCommunities: ['partner1'],
        });
        await setDoc(doc(db, 'users/mallory'), {
            role: 'user',
            joinedCommunities: [],
        });
        await setDoc(doc(db, 'communities/partner1'), {
            name: 'Cafe community',
        });
        await setDoc(doc(db, 'communities/partner1/messages/m1'), {
            senderId: 'alice',
            text: 'welcome members',
            createdAt: Date.now(),
        });
    });

    const malloryDb = testEnv.authenticatedContext('mallory').firestore();
    const aliceDb = testEnv.authenticatedContext('alice').firestore();

    // Attacker cannot self-grant membership via joinedCommunities
    await assertFails(updateDoc(doc(malloryDb, 'users/mallory'), {
        joinedCommunities: ['partner1'],
    }));

    // Attacker cannot self-grant via forged communityMembers on own doc (irrelevant) or partner doc
    await assertFails(updateDoc(doc(malloryDb, 'users/partner1'), {
        communityMembers: ['alice', 'mallory'],
    }));

    // Self-asserted joinedCommunities alone must not unlock community chat
    await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await updateDoc(doc(db, 'users/mallory'), {
            joinedCommunities: ['partner1'],
        });
    });
    await assertFails(getDoc(doc(malloryDb, 'communities/partner1')));
    await assertFails(getDocs(collection(malloryDb, 'communities/partner1/messages')));
    await assertFails(addDoc(collection(malloryDb, 'communities/partner1/messages'), {
        senderId: 'mallory',
        text: 'intrusion',
        createdAt: Date.now(),
    }));

    // Legitimate member (on partner.communityMembers) can read/write
    await assertSucceeds(getDoc(doc(aliceDb, 'communities/partner1')));
    await assertSucceeds(getDocs(collection(aliceDb, 'communities/partner1/messages')));
    await assertSucceeds(addDoc(collection(aliceDb, 'communities/partner1/messages'), {
        senderId: 'alice',
        text: 'hello again',
        createdAt: Date.now(),
    }));

    // Partner owner can still update non-membership profile fields
    const partnerDb = testEnv.authenticatedContext('partner1').firestore();
    await assertSucceeds(updateDoc(doc(partnerDb, 'users/partner1'), {
        displayName: 'Cafe Updated',
    }));
    await assertFails(updateDoc(doc(partnerDb, 'users/partner1'), {
        communityMembers: ['alice', 'mallory'],
    }));

    console.log('test-community-membership-security: all assertions passed');
} finally {
    await testEnv.cleanup();
}
