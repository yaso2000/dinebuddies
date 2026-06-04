import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getFollowers } from './followHelpers';

/** @typedef {'following' | 'mutual' | 'friend_of_friend' | 'interest' | 'discovery' | 'featured' | 'self'} FeedAudienceTier */

export const FEED_TIER_SCORE = {
    self: 120,
    following: 100,
    featured: 92,
    mutual: 80,
    friend_of_friend: 55,
    interest: 35,
    discovery: 12,
};

const FOF_PARENT_CAP = 40;

/**
 * @param {string[]} followingIds
 * @returns {Promise<{ followingSet: Set<string>, mutualSet: Set<string>, fofSet: Set<string>, viewerInterests: string[] }>}
 */
export async function buildFeedAudienceGraph(viewerUid, followingIds = [], viewerInterests = []) {
    const followingSet = new Set(
        (followingIds || []).map((id) => String(id)).filter((id) => id && id !== viewerUid)
    );

    const mutualSet = new Set();
    const fofSet = new Set();

    if (!viewerUid) {
        return { followingSet, mutualSet, fofSet, viewerInterests: normalizeInterests(viewerInterests) };
    }

    try {
        const followers = await getFollowers(viewerUid);
        for (const follower of followers) {
            const fid = String(follower.id || follower.uid || '');
            if (fid && followingSet.has(fid)) mutualSet.add(fid);
        }
    } catch (e) {
        console.warn('[feedSocialGraph] mutual followers', e);
    }

    const parents = [...followingSet].slice(0, FOF_PARENT_CAP);
    await Promise.all(
        parents.map(async (parentId) => {
            try {
                const snap = await getDoc(doc(db, 'users', parentId));
                const theirFollowing = snap.exists() ? snap.data()?.following : [];
                if (!Array.isArray(theirFollowing)) return;
                for (const raw of theirFollowing) {
                    const id = String(raw || '');
                    if (!id || id === viewerUid || followingSet.has(id) || mutualSet.has(id)) continue;
                    fofSet.add(id);
                }
            } catch {
                /* skip parent */
            }
        })
    );

    return {
        followingSet,
        mutualSet,
        fofSet,
        viewerInterests: normalizeInterests(viewerInterests),
    };
}

function normalizeInterests(list) {
    return [...new Set((list || []).map((x) => String(x || '').trim().toLowerCase()).filter(Boolean))];
}

export function authorIdFromPost(post) {
    return String(
        post?.authorId || post?.partnerId || post?.ownerId || post?.businessId || post?.author?.id || ''
    ).trim();
}

/** Business-authored feed items (featured slides, studio motion, mirrored community posts). */
export function isBusinessFeedPost(post) {
    if (!post || typeof post !== 'object') return false;
    if (post._isFeatured === true) return true;
    if (post.type === 'elite_slide' || post.source === 'featured_post') return true;
    if (post.partnerId || post.businessId || post.businessName || post.businessLogoUrl) return true;
    if (post.source === 'smart_post_studio') return true;
    if (String(post.accountType || '').toLowerCase() === 'business') return true;
    if (String(post.author?.role || post.role || '').toLowerCase() === 'business') return true;
    return false;
}

export const DISCOVER_BUSINESS_LIMIT = 24;

function featuredDedupeKey(post) {
    if (post?.featuredPostId) return `fp:${String(post.featuredPostId)}`;
    if (post?._isFeatured && post?.type === 'elite_slide' && post?.id) return `fp:${String(post.id)}`;
    return null;
}

function motionDedupeKey(post) {
    if (post?.motionPostId) return `motion:${String(post.motionPostId)}`;
    if (String(post?.id || '').startsWith('motion_')) return `motion:${String(post.id).replace(/^motion_/, '')}`;
    return null;
}

/** Prefer canonical featured_posts docs over community mirrors; one row per motion post. */
export function dedupeFeedPosts(posts) {
    const featuredByKey = new Map();
    const motionByKey = new Map();
    const rest = [];

    const featuredRank = (p) => {
        let score = 0;
        if (p?.title?.text) score += 4;
        if (p?.background) score += 2;
        if (p?._isFeatured && !p?.featuredPostId) score += 3;
        if (p?.partnerId) score += 1;
        return score;
    };

    for (const post of posts) {
        const fKey = featuredDedupeKey(post);
        if (fKey) {
            const prev = featuredByKey.get(fKey);
            if (!prev || featuredRank(post) > featuredRank(prev)) {
                featuredByKey.set(fKey, post);
            }
            continue;
        }
        const mKey = motionDedupeKey(post);
        if (mKey) {
            const prev = motionByKey.get(mKey);
            if (!prev || Boolean(post.motionPostSnapshot) && !prev.motionPostSnapshot) {
                motionByKey.set(mKey, post);
            }
            continue;
        }
        rest.push(post);
    }

    return [...featuredByKey.values(), ...motionByKey.values(), ...rest];
}

function isBlockedPost(post, blockedSet) {
    if (!blockedSet?.size) return false;
    const aid = authorIdFromPost(post);
    return Boolean(aid && blockedSet.has(aid));
}

/** Newest publish time first (featured, business, and personal posts in one list). */
export function sortFeedPostsByPublishDate(posts) {
    return [...posts].sort((a, b) => getPostTimestamp(b) - getPostTimestamp(a));
}

/**
 * Consumer home feed: all post types in one list, newest publish date first.
 *
 * @returns {{ mainFeed: object[], discoverFeed: object[] }}
 */
export function buildConsumerHomeFeed(posts, _graph, _viewerUid, options = {}) {
    const blocked = options.blockedSet instanceof Set ? options.blockedSet : new Set();
    const visible = dedupeFeedPosts(posts).filter((p) => !isBlockedPost(p, blocked));
    const mainFeed = sortFeedPostsByPublishDate(visible);
    return { mainFeed, discoverFeed: [] };
}

/**
 * @param {object} post
 * @param {{ followingSet: Set<string>, mutualSet: Set<string>, fofSet: Set<string>, viewerInterests: string[], viewerUid?: string }} graph
 * @returns {{ tier: FeedAudienceTier, score: number, interestHits: number }}
 */
export function classifyPostAudience(post, graph, viewerUid) {
    const authorId = authorIdFromPost(post);
    if (viewerUid && authorId && authorId === viewerUid) {
        return { tier: 'self', score: FEED_TIER_SCORE.self, interestHits: 0 };
    }

    if (authorId && graph.followingSet.has(authorId)) {
        return { tier: 'following', score: FEED_TIER_SCORE.following, interestHits: 0 };
    }

    if (isBusinessFeedPost(post)) {
        const seed = stableHash(`${authorId}:${post?.id || ''}`);
        const jitter = (seed % 1000) / 1000;
        return {
            tier: 'featured',
            score: FEED_TIER_SCORE.featured + jitter * 6,
            interestHits: 0,
        };
    }
    if (authorId && graph.mutualSet.has(authorId)) {
        return { tier: 'mutual', score: FEED_TIER_SCORE.mutual, interestHits: 0 };
    }
    if (authorId && graph.fofSet.has(authorId)) {
        return { tier: 'friend_of_friend', score: FEED_TIER_SCORE.friend_of_friend, interestHits: 0 };
    }

    const postInterests = normalizeInterests(
        post?.authorInterests || post?.author?.interests || post?.interests
    );
    const viewerSet = new Set(graph.viewerInterests || []);
    let interestHits = 0;
    for (const tag of postInterests) {
        if (viewerSet.has(tag)) interestHits += 1;
    }
    if (interestHits > 0) {
        return {
            tier: 'interest',
            score: FEED_TIER_SCORE.interest + interestHits * 8,
            interestHits,
        };
    }

    const seed = stableHash(`${authorId}:${post?.id || ''}`);
    const jitter = (seed % 1000) / 1000;
    return {
        tier: 'discovery',
        score: FEED_TIER_SCORE.discovery + jitter * 18,
        interestHits: 0,
    };
}

function stableHash(str) {
    let h = 0;
    const s = String(str || '');
    for (let i = 0; i < s.length; i += 1) {
        h = (h << 5) - h + s.charCodeAt(i);
        h |= 0;
    }
    return Math.abs(h);
}

export function getPostTimestamp(post) {
    const ts = post?.publishedAt || post?.updatedAt || post?.createdAt;
    if (!ts) return 0;
    return typeof ts.toDate === 'function' ? ts.toDate().getTime() : new Date(ts).getTime();
}

/**
 * Rank posts: audience tier (desc), then recency (desc).
 * @param {object[]} posts
 */
export function rankPostsForSocialFeed(posts, graph, viewerUid) {
    return [...posts]
        .map((post) => {
            const audience = classifyPostAudience(post, graph, viewerUid);
            return {
                post,
                ...audience,
                sortKey: audience.score * 1e12 + getPostTimestamp(post),
            };
        })
        .sort((a, b) => b.sortKey - a.sortKey)
        .map((row) => row.post);
}
