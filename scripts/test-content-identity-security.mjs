/**
 * Rules regression: community post / story / featured post identity binding.
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
    updateDoc,
} from 'firebase/firestore';

const projectId = 'demo-dinebuddies-content-identity';
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
        await setDoc(doc(db, 'communityPosts/owned'), {
            authorId: 'mallory',
            author: { id: 'mallory', name: 'Mallory' },
            content: 'hello',
            likes: [],
            comments: [],
            reposts: [],
        });
        await setDoc(doc(db, 'stories/owned'), {
            userId: 'mallory',
            userName: 'Mallory',
            type: 'text',
            text: 'hi',
        });
        await setDoc(doc(db, 'featured_posts/owned'), {
            partnerId: 'mallory',
            type: 'elite_slide',
            status: 'published',
            likes: [],
            comments: [],
            reposts: [],
        });
    });

    const malloryDb = testEnv.authenticatedContext('mallory').firestore();

    // Legitimate consumer post (CreatePost / InlinePostEditor shape)
    await assertSucceeds(setDoc(doc(malloryDb, 'communityPosts/ok-consumer'), {
        authorId: 'mallory',
        author: { id: 'mallory', name: 'Mallory' },
        content: 'legit',
        likes: [],
        comments: [],
        reposts: [],
    }));

    // Legitimate business event (ProEventPost shape)
    await assertSucceeds(setDoc(doc(malloryDb, 'communityPosts/ok-event'), {
        partnerId: 'mallory',
        type: 'event',
        status: 'published',
        likes: [],
        comments: 0,
    }));

    // Legitimate story (CreateStory shape)
    await assertSucceeds(setDoc(doc(malloryDb, 'stories/ok'), {
        userId: 'mallory',
        userName: 'Mallory',
        type: 'text',
        text: 'story',
    }));

    // PostCard prefers partnerId — mixed identity frames the victim
    await assertFails(setDoc(doc(malloryDb, 'communityPosts/spoof-partner'), {
        userId: 'mallory',
        partnerId: 'victim',
        content: 'framed',
    }));

    // BusinessProfile / feed query by authorId
    await assertFails(setDoc(doc(malloryDb, 'communityPosts/spoof-author'), {
        userId: 'mallory',
        authorId: 'victim',
        author: { id: 'victim', name: 'Victim' },
        content: 'framed',
    }));

    // StoriesBar uses userId || uid — plant victim userId with attacker authorId
    await assertFails(setDoc(doc(malloryDb, 'stories/spoof-userid'), {
        userId: 'victim',
        authorId: 'mallory',
        type: 'text',
        text: 'framed',
    }));

    await assertFails(setDoc(doc(malloryDb, 'stories/spoof-uid'), {
        uid: 'victim',
        authorId: 'mallory',
        type: 'text',
        text: 'framed',
    }));

    // Cannot reassign identity after a legitimate create
    await assertFails(updateDoc(doc(malloryDb, 'communityPosts/owned'), {
        partnerId: 'victim',
    }));
    await assertFails(updateDoc(doc(malloryDb, 'communityPosts/owned'), {
        authorId: 'victim',
        author: { id: 'victim', name: 'Victim' },
    }));
    await assertSucceeds(updateDoc(doc(malloryDb, 'communityPosts/owned'), {
        content: 'edited',
    }));

    await assertFails(updateDoc(doc(malloryDb, 'stories/owned'), {
        userId: 'victim',
    }));
    await assertSucceeds(updateDoc(doc(malloryDb, 'stories/owned'), {
        text: 'edited',
    }));

    await assertFails(updateDoc(doc(malloryDb, 'featured_posts/owned'), {
        partnerId: 'victim',
    }));
    await assertSucceeds(updateDoc(doc(malloryDb, 'featured_posts/owned'), {
        status: 'draft',
    }));

    console.log('test-content-identity-security: all assertions passed');
} finally {
    await testEnv.cleanup();
}
