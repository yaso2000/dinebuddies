import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    limit,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { db } from '../firebase/config';

function postCore(post) {
    return post?.type === 'repost' && post?.originalPost && typeof post.originalPost === 'object'
        ? post.originalPost
        : post;
}

function resolveFeaturedId(core) {
    if (core?.featuredPostId) return String(core.featuredPostId);
    if (
        core?._isFeatured &&
        (core?.type === 'elite_slide' || core?.source === 'featured_post')
    ) {
        return String(core.id || '');
    }
    return null;
}

function resolveCommunityDocId(core, featuredId) {
    const id = String(core?.id || '');
    if (!id || id.startsWith('motion_')) return null;
    if (featuredId && id === featuredId) return null;
    return id;
}

function resolveMotionId(core) {
    if (core?.motionPostId) return String(core.motionPostId);
    const id = String(core?.id || '');
    if (id.startsWith('motion_')) return id.replace(/^motion_/, '');
    return null;
}

async function deleteCommunityMirrorsForFeatured(featuredId) {
    try {
        const q = query(
            collection(db, 'communityPosts'),
            where('featuredPostId', '==', featuredId),
            limit(20)
        );
        const snap = await getDocs(q);
        await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    } catch (err) {
        console.warn('[deleteFeedPostCascade] featured community mirrors', err);
    }
}

async function deleteCommunityMirrorsForMotion(motionId) {
    try {
        const q = query(
            collection(db, 'communityPosts'),
            where('motionPostId', '==', motionId),
            limit(20)
        );
        const snap = await getDocs(q);
        await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    } catch (err) {
        console.warn('[deleteFeedPostCascade] motion community mirrors', err);
    }
}

async function retireFeaturedPost(featuredId) {
    const ref = doc(db, 'featured_posts', featuredId);
    try {
        await deleteDoc(ref);
    } catch (err) {
        console.warn('[deleteFeedPostCascade] featured delete, drafting', err);
        try {
            await updateDoc(ref, { status: 'draft', updatedAt: serverTimestamp() });
        } catch (draftErr) {
            console.warn('[deleteFeedPostCascade] featured draft', draftErr);
        }
    }
}

async function retireMotionPost(motionId) {
    const ref = doc(db, 'business_motion_posts', motionId);
    try {
        await deleteDoc(ref);
    } catch (err) {
        console.warn('[deleteFeedPostCascade] motion delete, drafting', err);
        try {
            await updateDoc(ref, {
                status: 'draft',
                updatedAt: serverTimestamp(),
            });
        } catch (draftErr) {
            console.warn('[deleteFeedPostCascade] motion draft', draftErr);
        }
    }
}

/**
 * Delete a feed post and all related documents (featured, community mirrors, motion studio).
 *
 * @param {Record<string, unknown>} post
 */
export async function deleteFeedPostCascade(post) {
    const core = postCore(post);
    const featuredId = resolveFeaturedId(core);
    const communityDocId = resolveCommunityDocId(core, featuredId);
    const motionId = resolveMotionId(core);

    if (!featuredId && !communityDocId && !motionId) {
        throw new Error('missing_post_id');
    }

    const tasks = [];

    if (featuredId) {
        tasks.push(retireFeaturedPost(featuredId));
        tasks.push(deleteCommunityMirrorsForFeatured(featuredId));
    }

    if (communityDocId) {
        tasks.push(
            deleteDoc(doc(db, 'communityPosts', communityDocId)).catch((err) => {
                console.warn('[deleteFeedPostCascade] communityPosts', communityDocId, err);
            })
        );
    }

    if (motionId) {
        tasks.push(retireMotionPost(motionId));
        tasks.push(deleteCommunityMirrorsForMotion(motionId));
    }

    await Promise.all(tasks);
}

/**
 * Hide orphaned community mirrors whose canonical featured/motion parent was removed.
 *
 * @param {object[]} posts
 * @param {Set<string>} publishedFeaturedIds
 * @param {Set<string>} publishedMotionIds
 */
export function filterOrphanedCommunityPosts(posts, publishedFeaturedIds, publishedMotionIds) {
    return posts.filter((p) => {
        if (p?.featuredPostId && !publishedFeaturedIds.has(String(p.featuredPostId))) {
            return false;
        }
        if (p?.motionPostId && !publishedMotionIds.has(String(p.motionPostId))) {
            return false;
        }
        return true;
    });
}
