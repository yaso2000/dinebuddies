/**
 * Rules regression:
 * 1) notifications — create-as-self then reassign userId to victim (inbox phishing)
 * 2) featured_posts — unpaid/consumer elite-feed publish
 * 3) invitations — forced joined membership / chat ACL without a prior request
 *
 * Requires Firestore emulator via @firebase/rules-unit-testing.
 */
import { readFileSync } from 'node:fs';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
    doc,
    setDoc,
    addDoc,
    collection,
    updateDoc,
} from 'firebase/firestore';

const projectId = 'demo-dinebuddies-notif-featured-joined';
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
        await setDoc(doc(db, 'users/mallory'), {
            role: 'user',
            display_name: 'Mallory',
        });
        await setDoc(doc(db, 'users/victim'), {
            role: 'user',
            display_name: 'Victim',
        });
        await setDoc(doc(db, 'users/freebiz'), {
            role: 'business',
            subscriptionTier: 'free',
            display_name: 'Free Biz',
        });
        await setDoc(doc(db, 'users/paidbiz'), {
            role: 'business',
            subscriptionTier: 'paid',
            display_name: 'Paid Biz',
        });
        await setDoc(doc(db, 'invitations/pub1'), {
            title: 'Dinner',
            author: { id: 'host', name: 'Host' },
            authorId: 'host',
            requests: ['alice'],
            joined: [],
        });
        await setDoc(doc(db, 'invitations/pub2'), {
            title: 'Brunch',
            author: { id: 'host', name: 'Host' },
            authorId: 'host',
            requests: [],
            joined: ['alice'],
        });
        await setDoc(doc(db, 'notifications/self1'), {
            userId: 'mallory',
            fromUserId: 'mallory',
            title: 'bait',
            message: 'click me',
            actionUrl: 'https://evil.example/phish',
            read: false,
        });
    });

    const malloryDb = testEnv.authenticatedContext('mallory').firestore();
    const hostDb = testEnv.authenticatedContext('host').firestore();
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const freeBizDb = testEnv.authenticatedContext('freebiz').firestore();
    const paidBizDb = testEnv.authenticatedContext('paidbiz').firestore();
    const victimDb = testEnv.authenticatedContext('victim').firestore();

    // --- 1) Notification userId reassignment / content rewrite ---
    await assertFails(updateDoc(doc(malloryDb, 'notifications/self1'), {
        userId: 'victim',
    }));
    await assertFails(updateDoc(doc(malloryDb, 'notifications/self1'), {
        title: 'rewritten phishing',
        message: 'open this',
        actionUrl: 'https://evil.example/2',
    }));
    await assertSucceeds(updateDoc(doc(malloryDb, 'notifications/self1'), {
        read: true,
        readAt: new Date(),
    }));
    // Victim still cannot read attacker-owned notification
    await assertFails(updateDoc(doc(victimDb, 'notifications/self1'), {
        read: true,
    }));

    // --- 2) Featured posts unpaid / consumer publish ---
    await assertFails(addDoc(collection(malloryDb, 'featured_posts'), {
        partnerId: 'mallory',
        type: 'elite_slide',
        status: 'published',
        title: { text: 'Spam' },
    }));
    await assertFails(addDoc(collection(freeBizDb, 'featured_posts'), {
        partnerId: 'freebiz',
        type: 'elite_slide',
        status: 'published',
        title: { text: 'Unpaid' },
    }));
    await assertSucceeds(addDoc(collection(paidBizDb, 'featured_posts'), {
        partnerId: 'paidbiz',
        type: 'elite_slide',
        status: 'published',
        title: { text: 'Legit' },
    }));

    // --- 3) Forced joined membership ---
    // Create with pre-seeded joined victim must fail
    await assertFails(setDoc(doc(hostDb, 'invitations/forged_joined'), {
        title: 'Trap',
        author: { id: 'host', name: 'Host' },
        authorId: 'host',
        requests: [],
        joined: ['victim'],
    }));
    // Host cannot arrayUnion victim into joined without a prior request
    await assertFails(updateDoc(doc(hostDb, 'invitations/pub1'), {
        joined: ['alice', 'victim'],
    }));
    await assertFails(updateDoc(doc(hostDb, 'invitations/pub1'), {
        joined: ['victim'],
        requests: ['alice'],
    }));
    // Legitimate approve: alice moves requests → joined
    await assertSucceeds(updateDoc(doc(hostDb, 'invitations/pub1'), {
        requests: [],
        joined: ['alice'],
    }));
    // Host can still update non-membership fields
    await assertSucceeds(updateDoc(doc(hostDb, 'invitations/pub1'), {
        title: 'Dinner updated',
    }));
    // Joined member can leave
    await assertSucceeds(updateDoc(doc(aliceDb, 'invitations/pub2'), {
        joined: [],
    }));
    // Non-member cannot clear someone else's joined entry
    await assertFails(updateDoc(doc(malloryDb, 'invitations/pub2'), {
        joined: [],
    }));

    console.log('test-notification-featured-joined-security: all assertions passed');
} finally {
    await testEnv.cleanup();
}
