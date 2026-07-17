import { readFile } from 'node:fs/promises';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
    doc,
    serverTimestamp,
    setDoc,
    updateDoc,
} from 'firebase/firestore';

const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const testEnv = await initializeTestEnvironment({
    projectId: 'demo-dinebuddies-user-security',
    firestore: { rules },
});

async function seedUser(uid, data) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'users', uid), data);
    });
}

const tests = [
    ['denies an admin role during owner create', async () => {
        const db = testEnv.authenticatedContext('mallory').firestore();
        await assertFails(setDoc(doc(db, 'users', 'mallory'), {
            uid: 'mallory',
            display_name: 'Mallory',
            role: 'admin',
        }));
    }],
    ['denies paid credits and a paid tier during owner create', async () => {
        const db = testEnv.authenticatedContext('alice').firestore();
        await assertFails(setDoc(doc(db, 'users', 'alice'), {
            uid: 'alice',
            display_name: 'Alice',
            role: 'user',
            paidCredits: 999999,
            subscriptionTier: 'elite',
        }));
    }],
    ['allows normal personal onboarding and auth-token mirrors', async () => {
        const db = testEnv.authenticatedContext('bob', {
            email: 'bob@example.com',
            email_verified: true,
        }).firestore();
        await assertSucceeds(setDoc(doc(db, 'users', 'bob'), {
            uid: 'bob',
            display_name: 'Bob',
            email: 'bob@example.com',
            role: 'user',
            emailVerified: true,
            authEmail: 'bob@example.com',
            isGuest: false,
            created_time: serverTimestamp(),
        }));
    }],
    ['denies spoofed email verification', async () => {
        const db = testEnv.authenticatedContext('eve', {
            email: 'eve@example.com',
            email_verified: false,
        }).firestore();
        await assertFails(setDoc(doc(db, 'users', 'eve'), {
            uid: 'eve',
            display_name: 'Eve',
            role: 'user',
            emailVerified: true,
            authEmail: 'eve@example.com',
        }));
    }],
    ['allows a free business profile create', async () => {
        const db = testEnv.authenticatedContext('bistro').firestore();
        await assertSucceeds(setDoc(doc(db, 'users', 'bistro'), {
            uid: 'bistro',
            display_name: 'Bistro',
            accountType: 'business',
            role: 'partner',
            subscriptionTier: 'free',
            businessInfo: {
                businessName: 'Bistro',
                isPublished: false,
            },
        }));
    }],
    ['allows safe completion of a role-less business signup stub', async () => {
        await seedUser('stub', {
            authEmail: 'stub@example.com',
            emailVerified: false,
            registrationIntent: 'business',
        });
        const db = testEnv.authenticatedContext('stub', {
            email: 'stub@example.com',
            email_verified: false,
        }).firestore();
        await assertSucceeds(updateDoc(doc(db, 'users', 'stub'), {
            uid: 'stub',
            role: 'business',
            accountType: 'business',
            subscriptionTier: 'free',
            businessInfo: { businessName: 'Stub Cafe' },
        }));
    }],
    ['denies entitlements added while completing a signup stub', async () => {
        await seedUser('paid-stub', { registrationIntent: 'business' });
        const db = testEnv.authenticatedContext('paid-stub').firestore();
        await assertFails(updateDoc(doc(db, 'users', 'paid-stub'), {
            uid: 'paid-stub',
            role: 'business',
            subscriptionTier: 'elite',
            paidCredits: 1000,
            businessInfo: { businessName: 'Paid Stub Cafe' },
        }));
    }],
    ['denies self-granting credits, tiers, and community membership on update', async () => {
        await seedUser('carol', {
            uid: 'carol',
            display_name: 'Carol',
            role: 'user',
            paidCredits: 0,
            subscriptionTier: 'free',
            joinedCommunities: [],
        });
        const db = testEnv.authenticatedContext('carol').firestore();
        await assertFails(updateDoc(doc(db, 'users', 'carol'), {
            paidCredits: 999999,
            subscriptionTier: 'elite',
            joinedCommunities: ['private-business'],
        }));
    }],
    ['denies owner changes to business custom limits', async () => {
        await seedUser('owner', {
            uid: 'owner',
            display_name: 'Owner',
            role: 'business',
            businessInfo: {
                businessName: 'Owner Cafe',
                customLimits: { featuredPosts: 1 },
            },
        });
        const db = testEnv.authenticatedContext('owner').firestore();
        await assertFails(updateDoc(doc(db, 'users', 'owner'), {
            businessInfo: {
                businessName: 'Owner Cafe',
                customLimits: { featuredPosts: 999 },
            },
        }));
        await assertFails(updateDoc(doc(db, 'users', 'owner'), {
            businessInfo: 'reset-protected-limits',
        }));
    }],
    ['allows ordinary owner profile and FCM updates', async () => {
        await seedUser('dana', {
            uid: 'dana',
            display_name: 'Dana',
            role: 'user',
        });
        const db = testEnv.authenticatedContext('dana').firestore();
        await assertSucceeds(updateDoc(doc(db, 'users', 'dana'), {
            display_name: 'Dana Updated',
            last_active_time: serverTimestamp(),
        }));
        await assertSucceeds(updateDoc(doc(db, 'users', 'dana'), {
            fcmTokens: ['token-1'],
        }));
    }],
    ['does not trust a Firestore admin role', async () => {
        await seedUser('doc-admin', {
            uid: 'doc-admin',
            display_name: 'Document Admin',
            role: 'admin',
        });
        await seedUser('victim', {
            uid: 'victim',
            display_name: 'Victim',
            role: 'user',
            paidCredits: 0,
        });
        const db = testEnv.authenticatedContext('doc-admin').firestore();
        await assertFails(updateDoc(doc(db, 'users', 'victim'), {
            paidCredits: 1000,
        }));
    }],
    ['allows a custom-claim admin to maintain server fields', async () => {
        await seedUser('admin-target', {
            uid: 'admin-target',
            display_name: 'Admin Target',
            role: 'user',
            paidCredits: 0,
        });
        const db = testEnv.authenticatedContext('claim-admin', { admin: true }).firestore();
        await assertSucceeds(updateDoc(doc(db, 'users', 'admin-target'), {
            paidCredits: 10,
            subscriptionTier: 'pro',
        }));
    }],
];

let failures = 0;
try {
    for (const [name, test] of tests) {
        await testEnv.clearFirestore();
        try {
            await test();
            console.log(`PASS ${name}`);
        } catch (error) {
            failures += 1;
            console.error(`FAIL ${name}`);
            console.error(error);
        }
    }
} finally {
    await testEnv.cleanup();
}

if (failures > 0) {
    throw new Error(`${failures} Firestore security rule test(s) failed`);
}
