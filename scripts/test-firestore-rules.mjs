import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

const emulatorPort = Number(process.env.FIRESTORE_EMULATOR_PORT || 8080);

const testEnv = await initializeTestEnvironment({
  projectId: `dinebuddies-rules-${Date.now()}`,
  firestore: {
    host: '127.0.0.1',
    port: emulatorPort,
    rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
  },
});

async function seedDoc(path, data) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

async function test(name, fn) {
  await testEnv.clearFirestore();
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

try {
  await test('denies self-creating an admin profile', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();

    await assertFails(setDoc(doc(db, 'users/alice'), {
      uid: 'alice',
      role: 'admin',
      display_name: 'Alice',
    }));
  });

  await test('allows normal personal profile bootstrap with the legacy welcome credit', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();

    await assertSucceeds(setDoc(doc(db, 'users/alice'), {
      uid: 'alice',
      role: 'user',
      display_name: 'Alice',
      purchasedPrivateCredits: 5,
      usedPrivateCreditsThisMonth: 0,
      lastPrivateResetMonth: '',
    }));
  });

  await test('allows normal business profile creation with a free tier', async () => {
    const partnerDb = testEnv.authenticatedContext('partner-owner').firestore();
    const businessDb = testEnv.authenticatedContext('business-owner').firestore();

    await assertSucceeds(setDoc(doc(partnerDb, 'users/partner-owner'), {
      uid: 'partner-owner',
      role: 'partner',
      accountType: 'business',
      display_name: 'Partner Cafe',
      businessInfo: { businessName: 'Partner Cafe' },
    }));

    await assertSucceeds(setDoc(doc(businessDb, 'users/business-owner'), {
      uid: 'business-owner',
      role: 'business',
      subscriptionTier: 'free',
      display_name: 'Business Cafe',
      businessInfo: { businessName: 'Business Cafe' },
    }));
  });

  await test('denies self-creating paid credit and paid subscription fields', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();

    await assertFails(setDoc(doc(db, 'users/alice'), {
      uid: 'alice',
      role: 'user',
      paidCredits: 999999,
    }));

    await assertFails(setDoc(doc(db, 'users/alice'), {
      uid: 'alice',
      role: 'business',
      accountType: 'business',
      subscriptionTier: 'elite',
    }));
  });

  await test('denies owner updates to credit and subscription entitlements', async () => {
    await seedDoc('users/alice', {
      uid: 'alice',
      role: 'user',
      display_name: 'Alice',
      purchasedPrivateCredits: 5,
      usedPrivateCreditsThisMonth: 0,
    });
    const db = testEnv.authenticatedContext('alice').firestore();
    const userRef = doc(db, 'users/alice');

    await assertSucceeds(updateDoc(userRef, { display_name: 'Alice Updated' }));
    await assertFails(updateDoc(userRef, { paidCredits: 999999 }));
    await assertFails(updateDoc(userRef, { freeCredits: 999999 }));
    await assertFails(updateDoc(userRef, { subscriptionTier: 'elite' }));
    await assertFails(updateDoc(userRef, { subscriptionStatus: 'active' }));
    await assertFails(updateDoc(userRef, { purchasedPrivateCredits: 999999 }));
  });

  await test('allows first profile bootstrap after an auth-email stub', async () => {
    await seedDoc('users/alice', {
      authEmail: 'alice@example.com',
      emailVerified: false,
    });
    const db = testEnv.authenticatedContext('alice').firestore();

    await assertSucceeds(setDoc(doc(db, 'users/alice'), {
      uid: 'alice',
      role: 'user',
      display_name: 'Alice',
      email: 'alice@example.com',
      purchasedPrivateCredits: 5,
      usedPrivateCreditsThisMonth: 0,
      lastPrivateResetMonth: '',
    }, { merge: true }));
  });

  await test('allows admins to manage entitlements', async () => {
    await seedDoc('users/admin', {
      uid: 'admin',
      role: 'admin',
    });
    await seedDoc('users/alice', {
      uid: 'alice',
      role: 'user',
      display_name: 'Alice',
    });
    const db = testEnv.authenticatedContext('admin').firestore();

    await assertSucceeds(updateDoc(doc(db, 'users/alice'), {
      paidCredits: 200,
      subscriptionTier: 'elite',
      subscriptionStatus: 'active',
    }));
  });
} finally {
  await testEnv.cleanup();
}
