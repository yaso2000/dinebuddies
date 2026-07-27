/**
 * Rules regression tests for:
 * 1) Social engagement mass-wipe / forgery on communityPosts, stories, featured_posts
 * 2) Arbitrary business ranking counter overwrites
 *
 * Requires Firestore emulator (via @firebase/rules-unit-testing).
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
    increment,
} from 'firebase/firestore';

const PROJECT_ID = 'dinebuddies-engagement-security';

const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
        rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
});

try {
    await testEnv.clearFirestore();

    const author = testEnv.authenticatedContext('author_1').firestore();
    const attacker = testEnv.authenticatedContext('attacker_1').firestore();
    const viewer = testEnv.authenticatedContext('viewer_1').firestore();

    // Seed a business user with ranking counters
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, 'users/biz_1'), {
            uid: 'biz_1',
            role: 'business',
            businessInfo: {
                name: 'Cafe',
                profileViews: 10,
                profileLikes: 5,
                profileShares: 2,
                totalInvitations: 3,
            },
        });
        await setDoc(doc(db, 'communityPosts/post_1'), {
            authorId: 'author_1',
            userId: 'author_1',
            content: 'hello',
            likes: ['user_x', 'user_y'],
            reposts: ['user_z'],
            comments: [
                { id: 'c1', userId: 'user_x', text: 'nice' },
                { id: 'c2', userId: 'user_y', text: 'great' },
            ],
        });
        await setDoc(doc(db, 'stories/story_1'), {
            userId: 'author_1',
            authorId: 'author_1',
            likes: ['user_x'],
            views: ['user_x'],
            reactions: [{ id: 'r1', userId: 'user_x', content: '❤️' }],
        });
        await setDoc(doc(db, 'featured_posts/feat_1'), {
            partnerId: 'author_1',
            likes: ['user_x', 'user_y'],
            reposts: [],
            comments: [{ id: 'c1', userId: 'user_x', text: 'wow' }],
        });
    });

    // --- Ranking counters: legitimate ±1 / +1 allowed ---
    await assertSucceeds(updateDoc(doc(viewer, 'users/biz_1'), {
        'businessInfo.profileViews': increment(1),
    }));
    await assertSucceeds(updateDoc(doc(viewer, 'users/biz_1'), {
        'businessInfo.profileLikes': increment(1),
    }));
    await assertSucceeds(updateDoc(doc(viewer, 'users/biz_1'), {
        'businessInfo.profileLikes': increment(-1),
    }));
    await assertSucceeds(updateDoc(doc(viewer, 'users/biz_1'), {
        'businessInfo.profileShares': increment(1),
    }));
    await assertSucceeds(updateDoc(doc(viewer, 'users/biz_1'), {
        'businessInfo.totalInvitations': increment(1),
    }));

    // --- Ranking counters: absolute overwrite / large jump denied ---
    await assertFails(updateDoc(doc(attacker, 'users/biz_1'), {
        'businessInfo.profileLikes': 999999,
    }));
    await assertFails(updateDoc(doc(attacker, 'users/biz_1'), {
        'businessInfo.profileViews': 0,
    }));
    await assertFails(updateDoc(doc(attacker, 'users/biz_1'), {
        'businessInfo.totalInvitations': increment(50),
    }));

    // --- communityPosts: self like ok; mass wipe / forge denied ---
    await assertSucceeds(updateDoc(doc(viewer, 'communityPosts/post_1'), {
        likes: ['user_x', 'user_y', 'viewer_1'],
    }));
    await assertSucceeds(updateDoc(doc(viewer, 'communityPosts/post_1'), {
        likes: ['user_x', 'user_y'],
    }));
    await assertFails(updateDoc(doc(attacker, 'communityPosts/post_1'), {
        likes: [],
        comments: [],
        reposts: [],
    }));
    await assertFails(updateDoc(doc(attacker, 'communityPosts/post_1'), {
        likes: ['forged_a', 'forged_b', 'forged_c'],
    }));
    await assertFails(updateDoc(doc(attacker, 'communityPosts/post_1'), {
        comments: [],
    }));
    await assertSucceeds(updateDoc(doc(viewer, 'communityPosts/post_1'), {
        comments: [
            { id: 'c1', userId: 'user_x', text: 'nice' },
            { id: 'c2', userId: 'user_y', text: 'great' },
            { id: 'c3', userId: 'viewer_1', text: 'me too' },
        ],
    }));

    // --- stories: self view/like ok; wipe denied ---
    await assertSucceeds(updateDoc(doc(viewer, 'stories/story_1'), {
        views: ['user_x', 'viewer_1'],
    }));
    await assertSucceeds(updateDoc(doc(viewer, 'stories/story_1'), {
        likes: ['user_x', 'viewer_1'],
        reactions: [
            { id: 'r1', userId: 'user_x', content: '❤️' },
            { id: 'r2', userId: 'viewer_1', content: '👍' },
        ],
    }));
    await assertFails(updateDoc(doc(attacker, 'stories/story_1'), {
        likes: [],
        views: [],
        reactions: [],
    }));

    // --- featured_posts: same social constraints ---
    await assertSucceeds(updateDoc(doc(viewer, 'featured_posts/feat_1'), {
        likes: ['user_x', 'user_y', 'viewer_1'],
    }));
    await assertFails(updateDoc(doc(attacker, 'featured_posts/feat_1'), {
        likes: [],
        comments: [],
    }));

    // Author full update still allowed (content edit path)
    await assertSucceeds(updateDoc(doc(author, 'communityPosts/post_1'), {
        content: 'updated hello',
    }));

    console.log('engagement security assertions passed');
} finally {
    await testEnv.cleanup();
}
