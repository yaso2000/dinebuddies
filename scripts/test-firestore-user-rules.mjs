import fs from 'node:fs';
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

const projectId = `dinebuddies-rules-${Date.now()}`;
const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
        rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
});

try {
    const alice = testEnv.authenticatedContext('alice');
    const aliceDb = alice.firestore();

    await assertFails(setDoc(doc(aliceDb, 'users/alice'), {
        uid: 'alice',
        email: 'alice@example.com',
        display_name: 'Alice',
        role: 'admin',
        paidCredits: 9999,
    }));

    await assertSucceeds(setDoc(doc(aliceDb, 'users/alice'), {
        uid: 'alice',
        email: 'alice@example.com',
        display_name: 'Alice',
        role: 'user',
    }));

    await assertSucceeds(updateDoc(doc(aliceDb, 'users/alice'), {
        display_name: 'Alice Updated',
    }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), {
        paidCredits: 9999,
    }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), {
        emailVerified: true,
    }));
    await assertSucceeds(updateDoc(doc(aliceDb, 'users/alice'), {
        emailVerified: false,
    }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), {
        role: 'admin',
    }));
    await assertFails(updateDoc(doc(aliceDb, 'users/alice'), {
        businessInfo: {
            customLimits: { offers: 999 },
        },
    }));

    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        const adminDb = adminContext.firestore();
        await setDoc(doc(adminDb, 'users/mallory'), {
            uid: 'mallory',
            role: 'admin',
            display_name: 'Mallory',
        });
        await setDoc(doc(adminDb, 'users/freeBiz'), {
            uid: 'freeBiz',
            role: 'partner',
            subscriptionTier: 'free',
            display_name: 'Free Biz',
        });
        await setDoc(doc(adminDb, 'users/paidBiz'), {
            uid: 'paidBiz',
            role: 'partner',
            offerCredits: 1,
            display_name: 'Paid Biz',
        });
    });

    const malloryDb = testEnv.authenticatedContext('mallory').firestore();
    await assertFails(setDoc(doc(malloryDb, 'subscriptionPlans/evil'), {
        tier: 'elite',
        price: 0,
    }));

    const claimsAdminDb = testEnv.authenticatedContext('claimsAdmin', { admin: true }).firestore();
    await assertSucceeds(setDoc(doc(claimsAdminDb, 'subscriptionPlans/ok'), {
        tier: 'elite',
        price: 29,
    }));

    const aliceVerifiedDb = testEnv.authenticatedContext('alice', {
        email: 'alice@example.com',
        email_verified: true,
    }).firestore();
    await assertSucceeds(updateDoc(doc(aliceVerifiedDb, 'users/alice'), {
        emailVerified: true,
        authEmail: 'alice@example.com',
    }));
    await assertFails(updateDoc(doc(aliceVerifiedDb, 'users/alice'), {
        authEmail: 'attacker@example.com',
    }));

    const businessDb = testEnv.authenticatedContext('businessOwner').firestore();
    await assertSucceeds(setDoc(doc(businessDb, 'users/businessOwner'), {
        uid: 'businessOwner',
        email: 'biz@example.com',
        display_name: 'Business Owner',
        role: 'partner',
        accountType: 'business',
        businessInfo: {
            businessName: 'Cafe',
            city: 'Sydney',
        },
    }));

    await assertFails(setDoc(doc(aliceDb, 'private_invitations/published'), {
        authorId: 'alice',
        invitedFriends: [],
        status: 'published',
        published: true,
    }));
    await assertSucceeds(setDoc(doc(aliceDb, 'private_invitations/draft'), {
        authorId: 'alice',
        invitedFriends: [],
        status: 'draft',
        published: false,
    }));
    await assertFails(updateDoc(doc(aliceDb, 'private_invitations/draft'), {
        status: 'published',
        published: true,
    }));

    await assertFails(setDoc(doc(aliceDb, 'partner_notifications/spoofed-feedback'), {
        restaurantId: 'paidBiz',
        type: 'business_feedback',
        title: 'Spoofed',
        message: 'Fake',
        senderId: 'mallory',
    }));
    await assertSucceeds(setDoc(doc(aliceDb, 'partner_notifications/self-feedback'), {
        restaurantId: 'paidBiz',
        type: 'business_feedback',
        title: 'New Suggestion',
        message: 'From: +15555555555',
        actionUrl: '/business-dashboard?tab=feedback_inbox',
        read: false,
        senderId: 'alice',
        fromUserName: 'Alice',
    }));

    const freeBizDb = testEnv.authenticatedContext('freeBiz').firestore();
    await assertFails(setDoc(doc(freeBizDb, 'offers/free-offer'), {
        partnerId: 'freeBiz',
        title: 'Free exploit offer',
    }));

    const paidBizDb = testEnv.authenticatedContext('paidBiz').firestore();
    await assertSucceeds(setDoc(doc(paidBizDb, 'offers/paid-offer'), {
        partnerId: 'paidBiz',
        title: 'Paid offer',
    }));
    await assertFails(updateDoc(doc(paidBizDb, 'offers/paid-offer'), {
        partnerId: 'freeBiz',
    }));
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        const adminDb = adminContext.firestore();
        await updateDoc(doc(adminDb, 'users/paidBiz'), {
            offerCredits: 0,
            subscriptionTier: 'free',
        });
    });
    await assertFails(updateDoc(doc(paidBizDb, 'offers/paid-offer'), {
        title: 'No longer paid',
    }));

    console.log('firestore critical security rules assertions passed');
} finally {
    await testEnv.cleanup();
}
