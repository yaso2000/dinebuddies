import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

const root = join(fileURLToPath(new URL('..', import.meta.url)));

const testEnv = await initializeTestEnvironment({
    projectId: `dinebuddies-rules-${Date.now()}`,
    firestore: {
        rules: readFileSync(join(root, 'firestore.rules'), 'utf8'),
    },
});

async function seedUser(uid, data) {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users', uid), data);
    });
}

try {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
        setDoc(doc(alice, 'users', 'alice'), {
            uid: 'alice',
            email: 'alice@example.com',
            display_name: 'Alice',
            role: 'admin',
        })
    );

    const bob = testEnv.authenticatedContext('bob').firestore();
    await assertFails(
        setDoc(doc(bob, 'users', 'bob'), {
            uid: 'bob',
            email: 'bob@example.com',
            display_name: 'Bob',
            role: 'user',
            paidCredits: 1000,
        })
    );

    const carol = testEnv.authenticatedContext('carol').firestore();
    await assertSucceeds(
        setDoc(doc(carol, 'users', 'carol'), {
            uid: 'carol',
            email: 'carol@example.com',
            display_name: 'Carol',
            role: 'user',
            isGuest: false,
        })
    );

    const dana = testEnv.authenticatedContext('dana').firestore();
    await assertSucceeds(
        setDoc(doc(dana, 'users', 'dana'), {
            authEmail: 'dana@example.com',
            emailVerified: false,
        }, { merge: true })
    );
    await assertSucceeds(
        setDoc(doc(dana, 'users', 'dana'), {
            uid: 'dana',
            email: 'dana@example.com',
            display_name: 'Dana',
            role: 'user',
            isGuest: false,
        }, { merge: true })
    );

    const eve = testEnv.authenticatedContext('eve').firestore();
    await assertSucceeds(
        setDoc(doc(eve, 'users', 'eve'), {
            uid: 'eve',
            email: 'eve@example.com',
            display_name: 'Eve Bistro',
            role: 'partner',
            accountType: 'business',
            businessInfo: {
                businessName: 'Eve Bistro',
                businessType: 'Restaurant',
            },
        })
    );

    const frank = testEnv.authenticatedContext('frank').firestore();
    await assertFails(
        setDoc(doc(frank, 'users', 'frank'), {
            uid: 'frank',
            email: 'frank@example.com',
            display_name: 'Frank Cafe',
            role: 'business',
            subscriptionTier: 'paid',
            businessInfo: {
                businessName: 'Frank Cafe',
                businessType: 'Cafe',
            },
        })
    );

    await seedUser('grace', {
        uid: 'grace',
        email: 'grace@example.com',
        display_name: 'Grace',
        role: 'user',
        paidCredits: 0,
        freeCredits: 0,
        subscriptionTier: 'free',
    });
    const grace = testEnv.authenticatedContext('grace').firestore();
    await assertFails(updateDoc(doc(grace, 'users', 'grace'), { paidCredits: 999 }));
    await assertFails(updateDoc(doc(grace, 'users', 'grace'), { subscriptionTier: 'paid' }));
    await assertSucceeds(updateDoc(doc(grace, 'users', 'grace'), { display_name: 'Grace Hopper' }));

    await seedUser('heidi', {
        uid: 'heidi',
        email: 'heidi@example.com',
        display_name: 'Heidi Cafe',
        role: 'business',
        businessInfo: {
            businessName: 'Heidi Cafe',
            customLimits: {
                featuredPosts: 0,
            },
        },
    });
    const heidi = testEnv.authenticatedContext('heidi').firestore();
    await assertFails(
        updateDoc(doc(heidi, 'users', 'heidi'), {
            businessInfo: {
                businessName: 'Heidi Cafe',
                customLimits: {
                    featuredPosts: 999,
                },
            },
        })
    );
    await assertSucceeds(
        updateDoc(doc(heidi, 'users', 'heidi'), {
            businessInfo: {
                businessName: 'Heidi Bistro',
                customLimits: {
                    featuredPosts: 0,
                },
            },
        })
    );

    console.log('Firestore user security rules tests passed');
} finally {
    await testEnv.cleanup();
}
