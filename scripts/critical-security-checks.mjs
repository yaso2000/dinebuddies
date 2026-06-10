import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
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
import { isPrivateAddress, validateRemoteImageUrl } from '../api/proxy.js';

const require = createRequire(import.meta.url);
const {
  assertCheckoutPriceMatches,
  getCheckoutPlan,
} = require('../functions/paymentPlans.js');

const projectId = `dinebuddies-critical-security-${Date.now()}`;

function assertPaymentCatalog() {
  const elite = getCheckoutPlan('elite');
  assert.equal(elite.id, 'p5');
  assert.equal(elite.mode, 'subscription');
  assert.equal(elite.priceId, 'price_1T4DlqKpQn3RDJUC6vrueW0n');
  assert.equal(getCheckoutPlan('not-a-plan'), null);
  assert.equal(assertCheckoutPriceMatches(elite, ['price_1T4DyrKpQn3RDJUCN6ipD592']), false);
  assert.equal(assertCheckoutPriceMatches(elite, ['price_1T4DlqKpQn3RDJUC6vrueW0n']), true);
}

async function assertProxyGuards() {
  assert.equal(isPrivateAddress('127.0.0.1'), true);
  assert.equal(isPrivateAddress('10.0.0.7'), true);
  assert.equal(isPrivateAddress('172.20.0.1'), true);
  assert.equal(isPrivateAddress('192.168.1.10'), true);
  assert.equal(isPrivateAddress('169.254.169.254'), true);
  assert.equal(isPrivateAddress('8.8.8.8'), false);

  await assert.rejects(() => validateRemoteImageUrl('http://localhost/private.png'), /Blocked host/);
  await assert.rejects(() => validateRemoteImageUrl('http://169.254.169.254/latest/meta-data'), /Blocked host/);
  await assert.rejects(() => validateRemoteImageUrl('file:///etc/passwd'), /Only http and https/);
}

async function assertFirestoreRules() {
  const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  });

  try {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'users/victim'), {
        uid: 'victim',
        role: 'user',
        display_name: 'Victim',
        paidCredits: 0,
        subscriptionTier: 'free',
      });
      await setDoc(doc(db, 'users/freeBiz'), {
        uid: 'freeBiz',
        role: 'business',
        display_name: 'Free Business',
        subscriptionTier: 'free',
        offerCredits: 0,
      });
      await setDoc(doc(db, 'users/paidBiz'), {
        uid: 'paidBiz',
        role: 'business',
        display_name: 'Paid Business',
        subscriptionTier: 'elite',
        offerCredits: 0,
      });
    });

    const victimDb = testEnv.authenticatedContext('victim').firestore();
    const freeBizDb = testEnv.authenticatedContext('freeBiz').firestore();
    const paidBizDb = testEnv.authenticatedContext('paidBiz').firestore();
    const adminDb = testEnv.authenticatedContext('adminUser', { admin: true }).firestore();

    await assertFails(updateDoc(doc(victimDb, 'users/victim'), { paidCredits: 9999 }));
    await assertFails(updateDoc(doc(victimDb, 'users/victim'), { subscriptionTier: 'elite' }));
    await assertFails(updateDoc(doc(victimDb, 'users/victim'), { role: 'admin' }));
    await assertSucceeds(updateDoc(doc(victimDb, 'users/victim'), { display_name: 'Updated Victim' }));

    await assertFails(setDoc(doc(victimDb, 'users/newAdmin'), {
      uid: 'newAdmin',
      role: 'admin',
      display_name: 'Self Admin',
    }));
    await assertFails(setDoc(doc(victimDb, 'users/victim'), {
      uid: 'victim',
      role: 'user',
      display_name: 'Minted',
      purchasedPrivateCredits: 5,
    }));

    await assertSucceeds(updateDoc(doc(adminDb, 'users/victim'), { paidCredits: 5 }));

    await assertFails(setDoc(doc(freeBizDb, 'offers/free-offer'), {
      partnerId: 'freeBiz',
      title: 'Unpaid premium offer',
      createdAt: serverTimestamp(),
    }));
    await assertSucceeds(setDoc(doc(paidBizDb, 'offers/paid-offer'), {
      partnerId: 'paidBiz',
      title: 'Paid premium offer',
      createdAt: serverTimestamp(),
    }));

    await assertFails(setDoc(doc(victimDb, 'private_invitations/published'), {
      authorId: 'victim',
      invitedFriends: ['friend'],
      status: 'published',
    }));
    await assertSucceeds(setDoc(doc(victimDb, 'private_invitations/draft'), {
      authorId: 'victim',
      invitedFriends: ['friend'],
      status: 'draft',
    }));
    await assertFails(updateDoc(doc(victimDb, 'private_invitations/draft'), {
      status: 'published',
    }));
  } finally {
    await testEnv.cleanup();
  }
}

assertPaymentCatalog();
await assertProxyGuards();
await assertFirestoreRules();

console.log('critical security checks passed');
