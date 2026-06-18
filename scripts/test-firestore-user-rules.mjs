import { readFile } from 'node:fs/promises';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';

const PROJECT_ID = 'demo-dinebuddies-user-rules';

const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');

const testEnv = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: { rules },
});

async function seedUser(uid, data) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const payload = {
      uid,
      display_name: uid,
      email: `${uid}@example.com`,
      role: 'user',
      ...data,
    };
    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined) {
        delete payload[key];
      }
    }
    await context.firestore().doc(`users/${uid}`).set(payload);
  });
}

async function seedPrivateInvitation(id, data) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(`private_invitations/${id}`).set({
      authorId: 'alice',
      author: { id: 'alice', name: 'Alice' },
      privacy: 'private',
      title: 'Draft dinner',
      invitedFriends: [],
      status: 'draft',
      ...data,
    });
  });
}

async function reset() {
  await testEnv.clearFirestore();
}

const tests = [
  [
    'denies self-granting paid credits and subscription tier on update',
    async () => {
      await seedUser('alice');
      const alice = testEnv.authenticatedContext('alice').firestore();

      await assertFails(
        alice.doc('users/alice').update({
          paidCredits: 999999,
          subscriptionTier: 'elite',
        }),
      );
    },
  ],
  [
    'denies protected entitlement fields during owner create',
    async () => {
      const bob = testEnv.authenticatedContext('bob').firestore();

      await assertFails(
        bob.doc('users/bob').set({
          uid: 'bob',
          display_name: 'Bob',
          email: 'bob@example.com',
          role: 'user',
          paidCredits: 999999,
          purchasedPrivateCredits: 999,
          reputation: 100000,
        }),
      );
    },
  ],
  [
    'denies admin role during owner create',
    async () => {
      const mallory = testEnv.authenticatedContext('mallory').firestore();

      await assertFails(
        mallory.doc('users/mallory').set({
          uid: 'mallory',
          display_name: 'Mallory',
          email: 'mallory@example.com',
          role: 'admin',
        }),
      );
    },
  ],
  [
    'denies adding protected fields while completing a role-less signup stub',
    async () => {
      await seedUser('stub', { role: undefined });
      const stub = testEnv.authenticatedContext('stub').firestore();

      await assertFails(
        stub.doc('users/stub').update({
          role: 'user',
          display_name: 'Stub',
          paidCredits: 100,
        }),
      );
    },
  ],
  [
    'allows safe owner profile create and update',
    async () => {
      const carol = testEnv.authenticatedContext('carol').firestore();
      const carolRef = carol.doc('users/carol');

      await assertSucceeds(
        carolRef.set({
          uid: 'carol',
          display_name: 'Carol',
          email: 'carol@example.com',
          role: 'user',
          isGuest: false,
        }),
      );

      await assertSucceeds(
        carolRef.update({
          display_name: 'Carol Updated',
          privacySettings: { profileVisibility: 'public' },
        }),
      );
    },
  ],
  [
    'denies client writes to business custom limit overrides',
    async () => {
      await seedUser('biz', {
        role: 'business',
        businessInfo: { businessName: 'Biz', city: 'Sydney' },
      });
      const biz = testEnv.authenticatedContext('biz', { role: 'business' }).firestore();

      await assertFails(
        biz.doc('users/biz').update({
          businessInfo: {
            businessName: 'Biz',
            city: 'Sydney',
            customLimits: { aiPosts: 999 },
          },
        }),
      );
    },
  ],
  [
    'denies direct client create of published private invitations',
    async () => {
      const alice = testEnv.authenticatedContext('alice').firestore();

      await assertFails(
        alice.doc('private_invitations/published-create').set({
          authorId: 'alice',
          author: { id: 'alice', name: 'Alice' },
          privacy: 'private',
          title: 'Bypassed publish',
          invitedFriends: [],
          status: 'published',
        }),
      );
    },
  ],
  [
    'denies host direct publish update for private invitation drafts',
    async () => {
      await seedPrivateInvitation('draft-private');
      const alice = testEnv.authenticatedContext('alice').firestore();

      await assertFails(
        alice.doc('private_invitations/draft-private').update({
          status: 'published',
          publishedAt: new Date(),
        }),
      );
    },
  ],
  [
    'allows host draft edits without publishing fields',
    async () => {
      await seedPrivateInvitation('editable-private');
      const alice = testEnv.authenticatedContext('alice').firestore();

      await assertSucceeds(
        alice.doc('private_invitations/editable-private').update({
          title: 'Updated draft dinner',
        }),
      );
    },
  ],
];

let failed = 0;
try {
  for (const [name, run] of tests) {
    await reset();
    try {
      await run();
      console.log(`PASS ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${name}`);
      console.error(error);
    }
  }
} finally {
  await testEnv.cleanup();
}

if (failed > 0) {
  throw new Error(`${failed} Firestore user rule test(s) failed`);
}
