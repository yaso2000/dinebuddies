import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { validateProxyUrl } from '../api/proxy.js';

const require = createRequire(import.meta.url);
const { getPaymentPlan, getPaymentPlanByPriceId } = require('../functions/paymentPlans.js');

const projectId = `dinebuddies-critical-${Date.now()}`;

async function assertRejectsMessage(promise, expectedMessagePart) {
    await assert.rejects(
        promise,
        (err) => String(err?.message || err).includes(expectedMessagePart)
    );
}

function assertPaymentCatalog() {
    assert.equal(getPaymentPlan('p2').priceId, 'price_1T4DptKpQn3RDJUCrhwtOx0u');
    assert.equal(getPaymentPlan('elite').id, 'p5');
    assert.equal(getPaymentPlan('o1').mode, 'payment');
    assert.equal(getPaymentPlan('c3').privateCredits, 5);
    assert.equal(getPaymentPlanByPriceId('price_1T4DlqKpQn3RDJUC6vrueW0n').tier, 'elite');
}

async function assertProxyValidation() {
    await assertRejectsMessage(validateProxyUrl('http://127.0.0.1/private.png'), 'Blocked proxy address');
    await assertRejectsMessage(validateProxyUrl('http://169.254.169.254/latest/meta-data'), 'Blocked proxy address');
    await assertRejectsMessage(validateProxyUrl('file:///etc/passwd'), 'Unsupported URL protocol');
    const publicUrl = await validateProxyUrl('https://example.com/image.png');
    assert.equal(publicUrl.hostname, 'example.com');
}

async function assertFirestoreRules(testEnv) {
    const alice = testEnv.authenticatedContext('alice', { email: 'alice@example.com' }).firestore();
    const bob = testEnv.authenticatedContext('bob', { email: 'bob@example.com' }).firestore();
    const biz = testEnv.authenticatedContext('biz', { email: 'biz@example.com' }).firestore();
    const anon = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(setDoc(doc(alice, 'users/alice'), {
        uid: 'alice',
        role: 'user',
        display_name: 'Alice',
        email: 'alice@example.com',
        created_time: new Date(),
    }));
    await assertFails(setDoc(doc(bob, 'users/bob'), {
        uid: 'bob',
        role: 'admin',
        display_name: 'Bob',
    }));
    await assertFails(setDoc(doc(bob, 'users/bob'), {
        uid: 'bob',
        role: 'user',
        paidCredits: 999,
    }));

    await assertSucceeds(updateDoc(doc(alice, 'users/alice'), { display_name: 'Alice Updated' }));
    await assertFails(updateDoc(doc(alice, 'users/alice'), { paidCredits: 999999 }));
    await assertFails(updateDoc(doc(alice, 'users/alice'), { subscriptionTier: 'elite', offerCredits: 10 }));
    await assertFails(updateDoc(doc(alice, 'users/alice'), {
        businessInfo: { customLimits: { maxPostsPerMonth: 999 } },
    }));

    await assertFails(setDoc(doc(alice, 'private_invitations/direct-publish'), {
        authorId: 'alice',
        invitedFriends: ['bob'],
        status: 'published',
        publishedAt: new Date(),
    }));
    await assertSucceeds(setDoc(doc(alice, 'private_invitations/draft'), {
        authorId: 'alice',
        invitedFriends: ['bob'],
        status: 'draft',
    }));
    await assertFails(updateDoc(doc(alice, 'private_invitations/draft'), {
        status: 'published',
        publishedAt: new Date(),
    }));

    await assertFails(setDoc(doc(alice, 'conversations/alice_bob'), {
        participants: ['alice', 'bob'],
        lastMessage: null,
        unreadBy: [],
    }));

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, 'conversations/alice_bob'), {
            participants: ['alice', 'bob'],
            lastMessage: null,
            unreadBy: [],
        });
        await setDoc(doc(db, 'users/biz'), {
            uid: 'biz',
            role: 'business',
            display_name: 'Biz',
            businessInfo: { businessName: 'Biz' },
            subscriptionTier: 'free',
        });
    });
    await assertSucceeds(updateDoc(doc(alice, 'conversations/alice_bob'), { lastMessage: 'hello' }));
    await assertFails(updateDoc(doc(alice, 'conversations/alice_bob'), { participants: ['alice', 'bob', 'mallory'] }));

    await assertFails(setDoc(doc(biz, 'offers/free-offer'), {
        partnerId: 'biz',
        title: 'Free exploit offer',
    }));
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), 'users/biz'), {
            subscriptionTier: 'professional',
            offerCredits: 1,
        });
    });
    await assertSucceeds(setDoc(doc(biz, 'offers/paid-offer'), {
        partnerId: 'biz',
        title: 'Paid offer',
    }));
    await assertFails(setDoc(doc(biz, 'featured_posts/professional-post'), {
        partnerId: 'biz',
        title: 'Not elite',
    }));
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), 'users/biz'), { subscriptionTier: 'elite' });
    });
    await assertSucceeds(setDoc(doc(biz, 'featured_posts/elite-post'), {
        partnerId: 'biz',
        title: 'Elite post',
    }));

    await assertFails(setDoc(doc(anon, 'partner_notifications/anon-feedback'), {
        restaurantId: 'biz',
        type: 'business_feedback',
        senderId: 'guest',
    }));
    await assertSucceeds(setDoc(doc(alice, 'partner_notifications/auth-feedback'), {
        restaurantId: 'biz',
        type: 'business_feedback',
        senderId: 'alice',
    }));
}

async function assertStorageRules(testEnv) {
    const aliceStorage = testEnv.authenticatedContext('alice').storage();
    const anonStorage = testEnv.unauthenticatedContext().storage();
    await assertFails(uploadBytes(ref(anonStorage, 'feedback_media/biz/proof.jpg'), new Uint8Array([1]), {
        contentType: 'image/jpeg',
    }));
    await assertSucceeds(uploadBytes(ref(aliceStorage, 'feedback_media/biz/proof.jpg'), new Uint8Array([1]), {
        contentType: 'image/jpeg',
    }));
}

const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
        rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
    storage: {
        rules: fs.readFileSync('storage.rules', 'utf8'),
    },
});

try {
    assertPaymentCatalog();
    await assertProxyValidation();
    await assertFirestoreRules(testEnv);
    await assertStorageRules(testEnv);
    console.log('critical security assertions passed');
} finally {
    await testEnv.cleanup();
}
