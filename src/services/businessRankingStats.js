import { collection, query, where, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/config';

const BATCH = 10;

export function isCompletedHostedInvitation(inv) {
    return inv?.status === 'completed' || inv?.meetingStatus === 'completed';
}

function emptyStats() {
    return {
        hostedInvitations: 0,
        profileLikes: 0,
        postLikes: 0,
        ratingStarsTotal: 0,
        subscriptionTier: 'free',
    };
}

async function loadCompletedHostedInvitationsForIds(ids) {
    const counts = Object.fromEntries(ids.map((id) => [id, 0]));

    for (let i = 0; i < ids.length; i += BATCH) {
        const chunk = ids.slice(i, i + BATCH);
        const snap = await getDocs(
            query(collection(db, 'invitations'), where('restaurantId', 'in', chunk), limit(500))
        ).catch(() => ({ docs: [] }));

        snap.docs.forEach((invDoc) => {
            const inv = invDoc.data();
            if (!isCompletedHostedInvitation(inv)) return;
            const restaurantId = inv.restaurantId;
            if (restaurantId && ids.includes(restaurantId)) {
                counts[restaurantId] = (counts[restaurantId] || 0) + 1;
            }
        });
    }

    return counts;
}

async function loadReviewStarsForIds(ids) {
    const ratingStarsById = Object.fromEntries(ids.map((id) => [id, 0]));
    const reviewsRef = collection(db, 'reviews');

    for (let i = 0; i < ids.length; i += BATCH) {
        const chunk = ids.slice(i, i + BATCH);
        const [partnerSnap, profileSnap, restaurantSnap] = await Promise.all([
            getDocs(query(reviewsRef, where('partnerId', 'in', chunk), limit(200))).catch(() => ({ docs: [] })),
            getDocs(query(reviewsRef, where('profileId', 'in', chunk), limit(200))).catch(() => ({ docs: [] })),
            getDocs(query(reviewsRef, where('restaurantId', 'in', chunk), limit(200))).catch(() => ({ docs: [] })),
        ]);

        const seen = new Set();
        const reviews = [];
        [...partnerSnap.docs, ...profileSnap.docs, ...restaurantSnap.docs].forEach((reviewDoc) => {
            if (seen.has(reviewDoc.id)) return;
            seen.add(reviewDoc.id);
            reviews.push(reviewDoc.data());
        });

        chunk.forEach((id) => {
            ratingStarsById[id] = reviews
                .filter((r) => r.partnerId === id || r.profileId === id || r.restaurantId === id)
                .reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
        });
    }

    return ratingStarsById;
}

async function loadPostLikesForIds(ids) {
    const postLikesById = Object.fromEntries(ids.map((id) => [id, 0]));

    for (let i = 0; i < ids.length; i += BATCH) {
        const chunk = ids.slice(i, i + BATCH);
        const snap = await getDocs(
            query(collection(db, 'communityPosts'), where('partnerId', 'in', chunk), limit(500))
        ).catch(() => ({ docs: [] }));

        snap.docs.forEach((postDoc) => {
            const post = postDoc.data();
            const partnerId = post.partnerId;
            if (!partnerId || !ids.includes(partnerId)) return;
            const likes = Array.isArray(post.likes) ? post.likes.length : 0;
            postLikesById[partnerId] = (postLikesById[partnerId] || 0) + likes;
        });
    }

    return postLikesById;
}

/**
 * @param {string[]} businessIds
 */
export async function loadBusinessRankingStatsMap(businessIds) {
    const ids = [...new Set((businessIds || []).filter(Boolean))];
    const statsById = Object.fromEntries(ids.map((id) => [id, emptyStats()]));
    if (!ids.length) return statsById;

    if (auth.currentUser) {
        for (let i = 0; i < ids.length; i += BATCH) {
            const chunk = ids.slice(i, i + BATCH);
            const userSnaps = await Promise.all(chunk.map((id) => getDoc(doc(db, 'users', id)).catch(() => null)));
            userSnaps.forEach((snap, idx) => {
                const id = chunk[idx];
                if (!snap?.exists()) return;
                const data = snap.data();
                const biz = data.businessInfo || {};
                statsById[id] = {
                    ...statsById[id],
                    profileLikes: Number(biz.profileLikes) || 0,
                    subscriptionTier: (data.subscriptionTier || 'free').toString().toLowerCase(),
                };
            });
        }
    }

    const [hostedById, ratingStarsById, postLikesById] = await Promise.all([
        loadCompletedHostedInvitationsForIds(ids),
        loadReviewStarsForIds(ids),
        loadPostLikesForIds(ids),
    ]);

    ids.forEach((id) => {
        statsById[id].hostedInvitations = hostedById[id] || 0;
        statsById[id].ratingStarsTotal = ratingStarsById[id] || 0;
        statsById[id].postLikes = postLikesById[id] || 0;
    });

    return statsById;
}

/**
 * @param {string} businessId
 * @param {object} [userProfile]
 */
export async function loadBusinessRankingStats(businessId, userProfile) {
    if (!businessId) return emptyStats();

    const biz = userProfile?.businessInfo || {};
    const stats = {
        hostedInvitations: 0,
        profileLikes: Number(biz.profileLikes) || 0,
        postLikes: 0,
        ratingStarsTotal: 0,
        subscriptionTier: (userProfile?.subscriptionTier || 'free').toString().toLowerCase(),
    };

    if (!stats.profileLikes && auth.currentUser) {
        const snap = await getDoc(doc(db, 'users', businessId)).catch(() => null);
        if (snap?.exists()) {
            const data = snap.data();
            const stored = data.businessInfo || {};
            stats.profileLikes = Number(stored.profileLikes) || 0;
            stats.subscriptionTier = (data.subscriptionTier || stats.subscriptionTier).toString().toLowerCase();
        }
    }

    const [hostedById, ratingStarsById, postLikesById] = await Promise.all([
        loadCompletedHostedInvitationsForIds([businessId]),
        loadReviewStarsForIds([businessId]),
        loadPostLikesForIds([businessId]),
    ]);

    stats.hostedInvitations = hostedById[businessId] || 0;
    stats.ratingStarsTotal = ratingStarsById[businessId] || 0;
    stats.postLikes = postLikesById[businessId] || 0;
    return stats;
}
