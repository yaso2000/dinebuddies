/**
 * Rules regression: Stage chat membership must not be self-grantable via joinedStages.
 * Requires Firestore emulator + @firebase/rules-unit-testing.
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

const projectId = 'demo-dinebuddies-stage-membership';
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
        await setDoc(doc(db, 'users/host1'), {
            role: 'user',
            joinedStages: ['stage1'],
        });
        await setDoc(doc(db, 'users/alice'), {
            role: 'user',
            joinedStages: ['stage1'],
        });
        await setDoc(doc(db, 'users/mallory'), {
            role: 'user',
            joinedStages: [],
        });
        await setDoc(doc(db, 'stages/stage1'), {
            kind: 'stage',
            hostId: 'host1',
            ownerId: 'host1',
            status: 'active',
            memberIds: ['host1', 'alice'],
            communityMembers: ['host1', 'alice'],
            communityBlockedUserIds: [],
            communityMutedUserIds: [],
        });
        await setDoc(doc(db, 'stages/stage1/messages/m1'), {
            senderId: 'alice',
            text: 'private stage chat',
            createdAt: Date.now(),
        });
    });

    const malloryDb = testEnv.authenticatedContext('mallory').firestore();
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const hostDb = testEnv.authenticatedContext('host1').firestore();

    // Attacker cannot self-grant membership via joinedStages
    await assertFails(
        updateDoc(doc(malloryDb, 'users/mallory'), {
            joinedStages: ['stage1'],
        })
    );

    // Even if joinedStages is forged server-side, it must not unlock Stage chat
    await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await updateDoc(doc(db, 'users/mallory'), {
            joinedStages: ['stage1'],
        });
    });
    await assertFails(getDoc(doc(malloryDb, 'stages/stage1')));
    await assertFails(getDocs(collection(malloryDb, 'stages/stage1/messages')));
    await assertFails(
        addDoc(collection(malloryDb, 'stages/stage1/messages'), {
            senderId: 'mallory',
            text: 'intrusion',
            createdAt: Date.now(),
        })
    );

    // Legitimate member can read/write
    await assertSucceeds(getDoc(doc(aliceDb, 'stages/stage1')));
    await assertSucceeds(getDocs(collection(aliceDb, 'stages/stage1/messages')));
    await assertSucceeds(
        addDoc(collection(aliceDb, 'stages/stage1/messages'), {
            senderId: 'alice',
            text: 'hello again',
            createdAt: Date.now(),
        })
    );

    // Host cannot force early purge by rewriting expiresAt
    await assertFails(
        updateDoc(doc(hostDb, 'stages/stage1'), {
            expiresAt: new Date('2000-01-01T00:00:00.000Z'),
        })
    );

    // Host may still edit non-lifecycle banner fields
    await assertSucceeds(
        updateDoc(doc(hostDb, 'stages/stage1'), {
            communityChatZoneTheme: 'stage',
        })
    );

    console.log('test-stage-membership-security: all assertions passed');
} finally {
    await testEnv.cleanup();
}
