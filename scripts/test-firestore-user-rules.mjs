import fs from 'node:fs';
import process from 'node:process';
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

const PROJECT_ID = 'dinebuddies-rules-test';
const rules = fs.readFileSync('firestore.rules', 'utf8');

const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules },
});

const userToken = (uid, email = `${uid}@example.com`) => ({
    email,
    email_verified: true,
});

const authedDb = (uid, email) => testEnv.authenticatedContext(uid, userToken(uid, email)).firestore();
const adminDb = () => testEnv.authenticatedContext('admin', {
    admin: true,
    email: 'admin@example.com',
    email_verified: true,
}).firestore();

async function seedUser(uid, data = {}) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'users', uid), {
            uid,
            email: `${uid}@example.com`,
            display_name: uid,
            role: 'user',
            ...data,
        });
    });
}

async function seedPrivateInvitation(id, data = {}) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'private_invitations', id), {
            authorId: 'host',
            author: { id: 'host', name: 'Host' },
            invitedFriends: ['guest'],
            rsvps: { guest: 'pending' },
            status: 'draft',
            privacy: 'private',
            ...data,
        });
    });
}

async function run(name, fn) {
    try {
        await fn();
        console.log(`ok - ${name}`);
    } catch (err) {
        console.error(`not ok - ${name}`);
        console.error(err);
        throw err;
    }
}

try {
    await run('owner can create a safe personal profile', async () => {
        const uid = 'safe-create';
        await assertSucceeds(setDoc(doc(authedDb(uid), 'users', uid), {
            uid,
            email: `${uid}@example.com`,
            display_name: 'Safe User',
            role: 'user',
            created_time: serverTimestamp(),
        }));
    });

    await run('owner cannot create admin role by self-writing users doc', async () => {
        const uid = 'admin-create';
        await assertFails(setDoc(doc(authedDb(uid), 'users', uid), {
            uid,
            email: `${uid}@example.com`,
            display_name: 'Attacker',
            role: 'admin',
        }));
    });

    await run('owner cannot create server-owned credit or subscription fields', async () => {
        const uid = 'credit-create';
        await assertFails(setDoc(doc(authedDb(uid), 'users', uid), {
            uid,
            email: `${uid}@example.com`,
            display_name: 'Attacker',
            role: 'user',
            paidCredits: 100000,
            subscriptionTier: 'elite',
        }));
    });

    await run('owner can update ordinary profile fields', async () => {
        const uid = 'safe-update';
        await seedUser(uid);
        await assertSucceeds(updateDoc(doc(authedDb(uid), 'users', uid), {
            display_name: 'Updated User',
            city: 'Berlin',
            lastSeen: serverTimestamp(),
        }));
    });

    await run('owner cannot update entitlement or membership fields', async () => {
        const uid = 'protected-update';
        await seedUser(uid);
        await assertFails(updateDoc(doc(authedDb(uid), 'users', uid), {
            paidCredits: 999,
        }));
        await assertFails(updateDoc(doc(authedDb(uid), 'users', uid), {
            subscriptionTier: 'elite',
        }));
        await assertFails(updateDoc(doc(authedDb(uid), 'users', uid), {
            joinedCommunities: ['target-business'],
        }));
    });

    await run('admin custom claim can update server-owned user fields', async () => {
        const uid = 'admin-managed';
        await seedUser(uid);
        await assertSucceeds(updateDoc(doc(adminDb(), 'users', uid), {
            paidCredits: 10,
            subscriptionTier: 'elite',
            updatedAt: serverTimestamp(),
        }));
    });

    await run('delete and recreate cannot escalate to admin', async () => {
        const uid = 'delete-recreate';
        const db = authedDb(uid);
        await seedUser(uid);
        await assertSucceeds(deleteDoc(doc(db, 'users', uid)));
        await assertFails(setDoc(doc(db, 'users', uid), {
            uid,
            email: `${uid}@example.com`,
            display_name: 'Recreated Admin',
            role: 'admin',
        }));
    });

    await run('private invitation clients can create and edit drafts only', async () => {
        const db = authedDb('host', 'host@example.com');
        await assertSucceeds(setDoc(doc(db, 'private_invitations', 'draft-create'), {
            authorId: 'host',
            author: { id: 'host', name: 'Host' },
            invitedFriends: ['guest'],
            rsvps: { guest: 'pending' },
            status: 'draft',
            privacy: 'private',
            createdAt: serverTimestamp(),
        }));

        await seedPrivateInvitation('draft-update');
        await assertSucceeds(updateDoc(doc(db, 'private_invitations', 'draft-update'), {
            title: 'Updated draft title',
            updatedAt: serverTimestamp(),
        }));
    });

    await run('private invitation clients cannot publish drafts directly', async () => {
        const db = authedDb('host', 'host@example.com');
        await seedPrivateInvitation('draft-publish');
        await assertFails(updateDoc(doc(db, 'private_invitations', 'draft-publish'), {
            status: 'published',
            publishedAt: serverTimestamp(),
        }));
    });
} finally {
    await testEnv.cleanup();
}

console.log('Firestore user rules security assertions passed.');
process.exit(0);
